use nodaysidle_cascade_v3_lib::export::{
    sha256_hex, validate_export_files, write_packet_atomic, ExportFile, DOCUMENT_NAMES,
};
use std::fs;

fn files() -> Vec<ExportFile> {
    [
        (
            "PRD.md",
            "prd\n",
            "e5fee9d9e15f08f04ad4cc142ef18c04c7194bc592914e6dd594f37264d7220b",
        ),
        (
            "ARD.md",
            "ard\n",
            "c24c0f1d483844a6c142bd45d090d3d9c690b5c8298750c2f30f5e952564ae26",
        ),
        (
            "TRD.md",
            "trd\n",
            "c146b2bdd89bdd86b8572aa50c006556f19492bbf55eb65bd2d70664cd09719f",
        ),
        (
            "TASKS.md",
            "tasks\n",
            "a66a0e03c3d7ff47ea0cd24ea81854cd9ac1c5fed59dac8442d05823ae978aba",
        ),
        (
            "AGENTS.md",
            "agents\n",
            "38700dfad5711976e2f7aeab31013f04aed8c83118a1ef892f6d23bdfe944602",
        ),
    ]
    .into_iter()
    .map(|(name, content, sha256)| ExportFile {
        name: name.to_string(),
        content: content.to_string(),
        sha256: sha256.to_string(),
    })
    .collect()
}

#[test]
fn validates_literal_sha256_and_exact_canonical_order() {
    assert_eq!(
        DOCUMENT_NAMES,
        ["PRD.md", "ARD.md", "TRD.md", "TASKS.md", "AGENTS.md"]
    );
    assert_eq!(
        sha256_hex(b"prd\n"),
        "e5fee9d9e15f08f04ad4cc142ef18c04c7194bc592914e6dd594f37264d7220b"
    );
    assert!(validate_export_files(&files()).is_ok());
}

#[test]
fn rejects_missing_extra_empty_reordered_and_hash_mismatch_packets() {
    let valid = files();
    let mut cases = Vec::new();
    cases.push(valid[..4].to_vec());
    let mut extra = valid.clone();
    extra.push(ExportFile {
        name: "EXTRA.md".into(),
        content: "extra".into(),
        sha256: sha256_hex(b"extra"),
    });
    cases.push(extra);
    let mut empty = valid.clone();
    empty[0].content.clear();
    cases.push(empty);
    let mut reordered = valid.clone();
    reordered.swap(0, 1);
    cases.push(reordered);
    let mut mismatch = valid;
    mismatch[0].content = "changed\n".into();
    cases.push(mismatch);

    for packet in cases {
        assert!(validate_export_files(&packet).is_err());
    }
}

#[test]
fn atomically_writes_exactly_five_byte_identical_files() {
    let root = tempfile::tempdir().unwrap();
    let destination = write_packet_atomic(root.path(), "harbor-sort", &files()).unwrap();
    assert_eq!(destination, root.path().join("harbor-sort"));

    let mut names: Vec<_> = fs::read_dir(&destination)
        .unwrap()
        .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
        .collect();
    names.sort();
    let mut expected: Vec<_> = DOCUMENT_NAMES.iter().map(|name| name.to_string()).collect();
    expected.sort();
    assert_eq!(names, expected);
    for file in files() {
        assert_eq!(
            fs::read(destination.join(&file.name)).unwrap(),
            file.content.as_bytes()
        );
    }
}

#[test]
fn rejects_collision_traversal_and_invalid_packets_without_partial_staging() {
    let root = tempfile::tempdir().unwrap();
    fs::create_dir(root.path().join("existing")).unwrap();
    fs::write(root.path().join("existing/keep.txt"), "keep").unwrap();
    assert!(write_packet_atomic(root.path(), "existing", &files()).is_err());
    assert_eq!(
        fs::read_to_string(root.path().join("existing/keep.txt")).unwrap(),
        "keep"
    );

    for slug in ["", ".", "..", "../escape", "nested/path", "with space"] {
        assert!(
            write_packet_atomic(root.path(), slug, &files()).is_err(),
            "accepted {slug}"
        );
    }

    let mut invalid = files();
    invalid[0].sha256 = "0".repeat(64);
    assert!(write_packet_atomic(root.path(), "bad-packet", &invalid).is_err());
    assert!(!root.path().join("bad-packet").exists());
    assert!(fs::read_dir(root.path()).unwrap().all(|entry| !entry
        .unwrap()
        .file_name()
        .to_string_lossy()
        .contains("staging")));
}
