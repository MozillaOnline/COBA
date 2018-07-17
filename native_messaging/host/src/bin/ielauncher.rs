extern crate byteorder;
extern crate serde;
#[macro_use]
extern crate serde_derive;
extern crate serde_json;

extern crate ielauncher;

use std::io::ErrorKind::UnexpectedEof;
use std::io::{self, Read, Write};
use std::process;

use byteorder::{NativeEndian, ReadBytesExt, WriteBytesExt};

#[derive(Deserialize)]
#[serde(untagged)]
enum WebExtMessage {
    NavigationDetails {
        url: String,
        #[serde(default)]
        request_body: String,
        #[serde(default)]
        request_headers: String,
    },
    TextCommand(String),
}

fn recv_message() -> WebExtMessage {
    let size = match io::stdin().read_u32::<NativeEndian>() {
        Ok(size) => size as usize,
        Err(ref err) if err.kind() == UnexpectedEof => process::exit(0),
        Err(_) => panic!("Failed to read the size"),
    };

    let mut buffer = vec![0u8; size];
    io::stdin()
        .read_exact(&mut buffer)
        .expect("Failed to read the message");

    serde_json::from_slice(&buffer).expect("Failed to decode the message")
}

fn send_message(message: &str) {
    let encoded_message = serde_json::to_string(message).expect("Failed to encode the message");

    let size = encoded_message.len();
    io::stdout()
        .write_u32::<NativeEndian>(size as u32)
        .expect("Failed to write the size");
    io::stdout()
        .write_all(encoded_message.as_bytes())
        .expect("Failed to write the message");
    io::stdout().flush().expect("Failed to flush the stdout");
}

fn main() {
    loop {
        match recv_message() {
            WebExtMessage::NavigationDetails {
                url,
                request_body,
                request_headers,
            } => {
                // maybe make sure the input is a valid url ?
                match ielauncher::navigate_ie_with(&url, &request_body, &request_headers) {
                    Ok(hr) => send_message(&format!("Navigate IE succeeded: {}", hr)),
                    Err(hr) => send_message(&format!("Navigate IE failed: {}", hr)),
                };
            }
            WebExtMessage::TextCommand(text_command) => {
                match text_command.as_str() {
                    "ping" => send_message("pong (from Rust!)"),
                    _ => send_message("Unknown text command"),
                };
            }
        }
    }
}
