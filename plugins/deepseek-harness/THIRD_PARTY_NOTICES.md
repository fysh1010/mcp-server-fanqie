# Third-party notices

`server/sign.mjs` ports the Argus/Ladon request-signing algorithms from the MIT-licensed Python project [tr4cex/TikTok-Encryption](https://github.com/tr4cex/TikTok-Encryption), specifically `signer/argus.py`, `signer/ladon.py` and `signer/lib/Simon.py`. It uses Node.js native hashing/AES and a small local serializer rather than adding Python or a signing service.

Copyright (c) 2024 TikTok Encryption Project. The upstream license and disclaimer are included in [licenses/TikTok-Encryption-MIT.txt](licenses/TikTok-Encryption-MIT.txt) and copied into standalone Skill runtimes.

The earlier GPL-3.0 reference implementation remains in an external scratch directory and is not distributed in this repository or its packages.
