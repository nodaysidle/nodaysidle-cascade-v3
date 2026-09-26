use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::HashSet,
    fmt::Write as FmtWrite,
    fs::{self, File, OpenOptions},
    io::{self, Write as IoWrite},
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
};

pub const DOCUMENT_NAMES: [&str; 5] = ["PRD.md", "ARD.md", "TRD.md", "TASKS.md", "AGENTS.md"];
const MAX_EXPORT_FILE_BYTES: usize = 2_000_000;
// A preset's starter kit follows the five documents, only under kit/ and in plain relative paths.
const KIT_PREFIX: &str = "kit/";
const MAX_KIT_FILES: usize = 64;
const MAX_KIT_PATH_DEPTH: usize = 8;
// The validated provider blueprint, exported next to the documents for audits.
const BLUEPRINT_FILE_NAME: &str = "blueprint.json";
#[cfg(target_os = "macos")]
const RENAME_EXCL: u32 = 0x0000_0004;
static STAGING_COUNTER: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportFile {
    pub name: String,
    pub content: String,
    pub sha256: String,
}

#[derive(Debug, Serialize)]
pub struct ExportFailure {
    pub kind: &'static str,
    pub classification: &'static str,
}

impl ExportFailure {
    fn invalid_packet() -> Self {
        Self {
            kind: "invalid-packet",
            classification: "export-gate-failure",
        }
    }

    pub(crate) fn invalid_destination() -> Self {
        Self {
            kind: "invalid-destination",
            classification: "export-destination-failure",
        }
    }

    pub(crate) fn write_failure() -> Self {
        Self {
            kind: "write",
            classification: "export-write-failure",
        }
    }
}

pub fn sha256_hex(bytes: &[u8]) -> String {
    let mut hex = String::with_capacity(64);
    for byte in Sha256::digest(bytes) {
        FmtWrite::write_fmt(&mut hex, format_args!("{byte:02x}"))
            .expect("writing to a String cannot fail");
    }
    hex
}

pub fn validate_export_files(files: &[ExportFile]) -> Result<(), ExportFailure> {
    if files.len() < DOCUMENT_NAMES.len() || files.len() > DOCUMENT_NAMES.len() + MAX_KIT_FILES + 1
    {
        return Err(ExportFailure::invalid_packet());
    }
    for (file, expected_name) in files.iter().zip(DOCUMENT_NAMES) {
        if file.name != expected_name || !valid_content(file) {
            return Err(ExportFailure::invalid_packet());
        }
    }
    let mut extra_names = HashSet::new();
    for file in &files[DOCUMENT_NAMES.len()..] {
        let allowed_name = file.name == BLUEPRINT_FILE_NAME || valid_kit_path(&file.name);
        if !allowed_name || !valid_content(file) || !extra_names.insert(file.name.as_str()) {
            return Err(ExportFailure::invalid_packet());
        }
    }
    Ok(())
}

fn valid_content(file: &ExportFile) -> bool {
    !file.content.trim().is_empty()
        && file.content.len() <= MAX_EXPORT_FILE_BYTES
        && file.sha256 == sha256_hex(file.content.as_bytes())
}

fn valid_kit_path(name: &str) -> bool {
    let Some(relative) = name.strip_prefix(KIT_PREFIX) else {
        return false;
    };
    let parts: Vec<&str> = relative.split('/').collect();
    parts.len() <= MAX_KIT_PATH_DEPTH
        && parts.iter().all(|part| {
            !part.is_empty()
                && !part.starts_with('.')
                && part
                    .bytes()
                    .all(|byte| byte.is_ascii_alphanumeric() || b"._-+".contains(&byte))
        })
}

pub fn write_packet_atomic(
    parent: &Path,
    slug: &str,
    files: &[ExportFile],
) -> Result<PathBuf, ExportFailure> {
    validate_export_files(files)?;
    if !valid_slug(slug) {
        return Err(ExportFailure::invalid_destination());
    }
    let parent = parent
        .canonicalize()
        .map_err(|_| ExportFailure::invalid_destination())?;
    if !parent.is_dir() {
        return Err(ExportFailure::invalid_destination());
    }
    let destination = parent.join(slug);
    if destination.exists() {
        return Err(ExportFailure::invalid_destination());
    }

    let staging = create_staging_directory(&parent, slug)?;
    let write_result = write_staging_packet(&staging, files);
    if write_result.is_err() {
        let _cleanup = fs::remove_dir_all(&staging);
        return Err(ExportFailure::write_failure());
    }
    if rename_exclusive(&staging, &destination).is_err() {
        let _cleanup = fs::remove_dir_all(&staging);
        return Err(ExportFailure::write_failure());
    }
    if verify_written_packet(&destination, files).is_err() {
        let _cleanup = fs::remove_dir_all(&destination);
        return Err(ExportFailure::write_failure());
    }
    if let Ok(directory) = File::open(&parent) {
        let _sync_result = directory.sync_all();
    }
    Ok(destination)
}

fn rename_exclusive(from: &Path, to: &Path) -> io::Result<()> {
    #[cfg(target_os = "macos")]
    {
        use std::ffi::CString;
        use std::os::raw::c_char;
        use std::os::unix::ffi::OsStrExt;
        extern "C" {
            fn renamex_np(from: *const c_char, to: *const c_char, flags: u32) -> i32;
        }
        let from_c = CString::new(from.as_os_str().as_bytes())
            .map_err(|_| io::Error::new(io::ErrorKind::InvalidInput, "export path"))?;
        let to_c = CString::new(to.as_os_str().as_bytes())
            .map_err(|_| io::Error::new(io::ErrorKind::InvalidInput, "export path"))?;
        let rc = unsafe { renamex_np(from_c.as_ptr(), to_c.as_ptr(), RENAME_EXCL) };
        if rc == 0 {
            Ok(())
        } else {
            Err(io::Error::last_os_error())
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        fs::rename(from, to)
    }
}

fn verify_written_packet(destination: &Path, files: &[ExportFile]) -> io::Result<()> {
    for file in files {
        let bytes = fs::read(destination.join(&file.name))?;
        if sha256_hex(&bytes) != file.sha256 {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                "export hash mismatch",
            ));
        }
    }
    Ok(())
}

fn valid_slug(slug: &str) -> bool {
    !slug.is_empty()
        && slug.split('-').all(|part| {
            !part.is_empty()
                && part
                    .bytes()
                    .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit())
        })
}

fn create_staging_directory(parent: &Path, slug: &str) -> Result<PathBuf, ExportFailure> {
    for _ in 0..16 {
        let sequence = STAGING_COUNTER.fetch_add(1, Ordering::Relaxed);
        let staging = parent.join(format!(
            ".cascade-{slug}-{}-{sequence}.staging",
            std::process::id()
        ));
        match fs::create_dir(&staging) {
            Ok(()) => return Ok(staging),
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(_) => return Err(ExportFailure::write_failure()),
        }
    }
    Err(ExportFailure::write_failure())
}

fn write_staging_packet(staging: &Path, files: &[ExportFile]) -> io::Result<()> {
    for file in files {
        let path = staging.join(&file.name);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        let mut output = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&path)?;
        output.write_all(file.content.as_bytes())?;
        output.sync_all()?;
        // Kit scripts are exported ready to run.
        #[cfg(unix)]
        if file.name.starts_with(KIT_PREFIX) && file.name.ends_with(".sh") {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&path, fs::Permissions::from_mode(0o755))?;
        }
    }
    File::open(staging)?.sync_all()
}
