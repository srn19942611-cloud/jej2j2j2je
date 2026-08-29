// Tom stub for Node-indbyggede moduler.
//
// @anthropic-ai/sdk kan læse legitimationsoplysninger fra disk, når den kører
// på en server. På en telefon findes hverken `node:fs` eller `node:path`, og
// den kodesti bliver aldrig kaldt — vi giver nøglen direkte til klienten. Uden
// stubben kan Metro ikke pakke SDK'et overhovedet.
module.exports = {};
