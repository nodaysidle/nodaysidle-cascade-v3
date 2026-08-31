use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fmt::Write as FmtWrite,
    fs::{self, File, OpenOptions},
    io::{self, Write as IoWrite},
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
};

pub const DOCUMENT_NAMES: [&str; 5] = ["PRD.md", "ARD.md", "TRD.md", "TASKS.md", "AGENTS.md"];
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
    if files.len() != DOCUMENT_NAMES.len() {
        return Err(ExportFailure::invalid_packet());
    }
    for (file, expected_name) in files.iter().zip(DOCUMENT_NAMES) {
        if file.name != expected_name
            || file.content.trim().is_empty()
            || file.sha256 != sha256_hex(file.content.as_bytes())
        {
            return Err(ExportFailure::invalid_packet());
        }
    }
    Ok(())
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
    let requested_destination = parent.join(slug);
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
    if fs::rename(&staging, &destination).is_err() {
        let _cleanup = fs::remove_dir_all(&staging);
        return Err(ExportFailure::write_failure());
    }
    if let Ok(directory) = File::open(&parent) {
        let _sync_result = directory.sync_all();
    }
    Ok(requested_destination)
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
        let mut output = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(staging.join(&file.name))?;
        output.write_all(file.content.as_bytes())?;
        output.sync_all()?;
    }
    File::open(staging)?.sync_all()
}
