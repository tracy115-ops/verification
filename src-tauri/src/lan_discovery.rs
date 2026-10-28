use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, HashSet},
    net::Ipv4Addr,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tokio::{
    net::UdpSocket,
    process::Command,
    time::{Instant, timeout_at},
};

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LanPeer {
    id: String,
    name: String,
    url: String,
}
#[derive(Deserialize)]
struct Offer {
    protocol: String,
    version: u8,
    #[serde(rename = "type")]
    kind: String,
    nonce: String,
    id: String,
    name: String,
    port: u16,
}

fn decode(packet: &[u8], nonce: &str, address: Ipv4Addr) -> Option<LanPeer> {
    let offer: Offer = serde_json::from_slice(packet).ok()?;
    if offer.protocol != "verification-workbench"
        || offer.version != 1
        || offer.kind != "offer"
        || offer.nonce != nonce
        || offer.port < 1024
        || offer.id.len() > 80
        || offer.id.is_empty()
        || offer.name.is_empty()
        || offer.name.chars().count() > 80
        || offer.name.chars().any(char::is_control)
    {
        return None;
    }
    Some(LanPeer {
        id: offer.id,
        name: offer.name,
        url: format!("http://{address}:{}", offer.port),
    })
}
#[tauri::command]
pub async fn discover_collaboration() -> Result<Vec<LanPeer>, String> {
    let socket = UdpSocket::bind("0.0.0.0:0")
        .await
        .map_err(|_| "lan_discovery_failed")?;
    socket
        .set_broadcast(true)
        .map_err(|_| "lan_discovery_failed")?;
    let nonce = format!(
        "{}-{}",
        std::process::id(),
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos()
    );
    let request = serde_json::json!({"protocol":"verification-workbench","version":1,"type":"discover","nonce":nonce}).to_string();
    // A single global broadcast can follow a VPN route. Also probe each active LAN subnet.
    let mut broadcasts = HashSet::from([Ipv4Addr::BROADCAST]);
    for interface in if_addrs::get_if_addrs()
        .unwrap_or_default()
        .into_iter()
        .take(32)
    {
        if !interface.is_oper_up() || interface.is_loopback() || interface.is_p2p() {
            continue;
        }
        if let if_addrs::IfAddr::V4(address) = interface.addr
            && let Some(broadcast) = address.broadcast
        {
            broadcasts.insert(broadcast);
        }
    }
    for broadcast in broadcasts {
        let _ = socket.send_to(request.as_bytes(), (broadcast, 4319)).await;
    }
    socket
        .send_to(request.as_bytes(), "127.0.0.1:4319")
        .await
        .map_err(|_| "lan_discovery_failed")?;
    let deadline = Instant::now() + Duration::from_millis(1800);
    let mut peers: HashMap<String, (u8, LanPeer)> = HashMap::new();
    let mut buffer = [0u8; 2048];
    while let Ok(Ok((length, remote))) = timeout_at(deadline, socket.recv_from(&mut buffer)).await {
        let std::net::IpAddr::V4(address) = remote.ip() else {
            continue;
        };
        if let Some(peer) = decode(&buffer[..length], &nonce, address) {
            let priority = if address.is_loopback() {
                0
            } else if address.is_private() {
                2
            } else {
                1
            };
            if peers
                .get(&peer.id)
                .is_none_or(|(previous, _)| priority > *previous)
            {
                peers.insert(peer.id.clone(), (priority, peer));
            }
        }
        if peers.len() >= 32 {
            break;
        }
    }
    let mut peers: Vec<_> = peers.into_values().map(|(_, peer)| peer).collect();
    peers.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(peers)
}
fn valid_url(value: &str) -> bool {
    let Some(target) = value.strip_prefix("http://") else {
        return false;
    };
    let Some((ip, port)) = target.split_once(':') else {
        return false;
    };
    let Ok(ip) = ip.parse::<Ipv4Addr>() else {
        return false;
    };
    let Ok(port) = port.parse::<u16>() else {
        return false;
    };
    port >= 1024 && !ip.is_unspecified() && !ip.is_multicast() && !ip.is_broadcast()
}
#[tauri::command]
pub async fn open_collaboration(url: String) -> Result<(), String> {
    if !valid_url(&url) {
        return Err("lan_invalid".into());
    }
    #[cfg(windows)]
    let mut command = {
        let mut command = Command::new("rundll32.exe");
        command
            .args(["url.dll,FileProtocolHandler", &url])
            .creation_flags(0x08000000);
        command
    };
    #[cfg(target_os = "macos")]
    let mut command = {
        let mut command = Command::new("open");
        command.arg(&url);
        command
    };
    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = {
        let mut command = Command::new("xdg-open");
        command.arg(&url);
        command
    };
    command
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|_| "lan_open_failed")?;
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn browser_url_cannot_contain_shell_arguments_or_paths() {
        assert!(valid_url("http://192.168.1.2:4317"));
        for value in [
            "file:///etc/passwd",
            "http://host:4317",
            "http://127.0.0.1:4317/&calc",
            "http://0.0.0.0:4317",
            "http://127.0.0.1:80",
        ] {
            assert!(!valid_url(value));
        }
    }
    #[test]
    fn only_correlated_versioned_offers_are_accepted() {
        let packet = br#"{"protocol":"verification-workbench","version":1,"type":"offer","nonce":"test","id":"server","name":"Team","port":4317}"#;
        assert!(decode(packet, "test", Ipv4Addr::LOCALHOST).is_some());
        assert!(decode(packet, "different", Ipv4Addr::LOCALHOST).is_none());
        assert!(decode(b"{}", "test", Ipv4Addr::LOCALHOST).is_none());
    }
}
