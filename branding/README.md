# Sidepiece branding

`sidepiece-mark.svg` is the canonical Sidepiece mark: a green disc with an amber slice pulled out to the side: a literal side piece, the panel beside the page. Picked by Jarad on 2026-10-19 from three drafts (HOLOC-15).

It is the avatar of `sidepiece-pm` on the Holocene Agent Pad, set through Holocene's avatar setter (holocene.delo.sh/settings).
To change it, edit the SVG here, render a square JPEG with the `hermes-project-avatar` skill's converter and upload it there:

```bash
python3 ~/.agents/skills/hermes-project-avatar/scripts/telegram_avatar.py convert \
  --svg branding/sidepiece-mark.svg --out /tmp/sidepiece-avatar.jpg --pad 6
curl -X PUT -H 'Content-Type: image/jpeg' --data-binary @/tmp/sidepiece-avatar.jpg \
  http://127.0.0.1:4000/api/modules/avatars/<agent-id>
```
