#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if let Err(error) = verification_desktop_lib::run() {
        eprintln!("Desktop runtime failed: {error}");
        std::process::exit(1);
    }
}
