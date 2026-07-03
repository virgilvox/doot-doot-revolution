// A tiny yt-dlp backend so the web app can import YouTube audio (the browser cannot
// rip YouTube itself). GET /?url=<youtube-url> runs yt-dlp via youtube-dl-exec and
// returns the best audio-only stream, with the video title URL-encoded in the
// X-Video-Title header and the container in Content-Type. Point the web app's
// VITE_YT_ENDPOINT env var at this service's URL.
//
// Reality check: this runs from a datacenter IP, and YouTube rate-limits and 403s
// cloud IPs, so expect intermittent failures under load (the desktop app, on a home
// IP, is more reliable). Downloading YouTube audio is subject to YouTube's terms and
// to copyright; run this only for content you are entitled to use. Set ALLOW_ORIGIN
// to your site's origin (not the default *) so it is not an open ripper for everyone.

import http from 'node:http';
import { readFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ytdlp from 'youtube-dl-exec';

const PORT = process.env.PORT || 8080;
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || '*';
const MAX_SECONDS = Number(process.env.MAX_SECONDS || 12 * 60);
// YouTube bot-checks the default web client hard from datacenter IPs. Forcing less
// gated player clients avoids it more often (no guarantee — cloud IPs get blocked).
// Override with YT_PLAYER_CLIENT, or set YT_COOKIES to a Netscape cookies file path.
const PLAYER_CLIENT = process.env.YT_PLAYER_CLIENT || 'android_vr,tv,web_safari';
const COOKIES = process.env.YT_COOKIES || '';

function isYouTube(u) {
  try { const h = new URL(u).hostname.replace(/^(www|m|music)\./, ''); return h === 'youtube.com' || h === 'youtu.be'; }
  catch (e) { return false; }
}
function sniffMime(b) {
  if (b.length > 4 && b[0] === 0x1A && b[1] === 0x45 && b[2] === 0xDF && b[3] === 0xA3) return 'audio/webm';
  if (b.length > 8 && b.toString('ascii', 4, 8) === 'ftyp') return 'audio/mp4';
  if (b.length > 3 && (b.toString('ascii', 0, 3) === 'ID3' || (b[0] === 0xFF && (b[1] & 0xE0) === 0xE0))) return 'audio/mpeg';
  return 'audio/webm';
}

process.on('uncaughtException', (e) => console.error('uncaughtException:', (e && e.stack) || e));
process.on('unhandledRejection', (e) => console.error('unhandledRejection:', (e && e.stack) || e));

const server = http.createServer(async (req, res) => {
  const t0 = Date.now();
  const cors = { 'Access-Control-Allow-Origin': ALLOW_ORIGIN, 'Access-Control-Expose-Headers': 'X-Video-Title' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  const target = new URL(req.url, 'http://x').searchParams.get('url');
  // no url is the health/root probe (App Platform checks the container root); 200 keeps
  // the component healthy. a present-but-non-YouTube url is a real bad request.
  if (!target) { res.writeHead(200, cors); return res.end('doot yt-service ok'); }
  console.log('rip request:', target);
  if (!isYouTube(target)) { res.writeHead(400, cors); return res.end('not a YouTube url'); }
  const base = { noPlaylist: true, noWarnings: true, jsRuntimes: 'node', extractorArgs: 'youtube:player_client=' + PLAYER_CLIENT };
  if (COOKIES) base.cookies = COOKIES;
  const out = path.join(tmpdir(), `yt-${Date.now()}-${Math.floor(process.hrtime()[1])}.audio`);
  try {
    const info = await ytdlp(target, { ...base, dumpSingleJson: true, format: 'bestaudio' });
    console.log('meta ok:', info.title, info.duration + 's', 'in', Date.now() - t0 + 'ms');
    if ((Number(info.duration) || 0) > MAX_SECONDS) { res.writeHead(413, cors); return res.end('video too long'); }
    await ytdlp(target, { ...base, format: 'bestaudio', output: out });
    const buf = await readFile(out);
    console.log('download ok:', buf.length, 'bytes in', Date.now() - t0 + 'ms');
    res.writeHead(200, { ...cors, 'Content-Type': sniffMime(buf), 'X-Video-Title': encodeURIComponent(info.title || 'YouTube'), 'Cache-Control': 'no-store' });
    res.end(buf);
  } catch (e) {
    console.error('rip failed in', Date.now() - t0 + 'ms:', String((e && e.stack) || e).slice(0, 500));
    res.writeHead(502, cors); res.end('rip failed: ' + String((e && e.message) || e).slice(0, 200));
  } finally { unlink(out).catch(() => {}); }
});
server.listen(PORT, '0.0.0.0', () => console.log('doot yt-service listening on ' + PORT));
