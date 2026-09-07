/* Loads optional placeholder replacements from ./assets and hands them to the engine.
   card1.png..card4.png -> the four finished-video cards (9:16)
   post.png             -> the Instagram post media (1:1)                       */
const fs = require('fs'), path = require('path');
const { loadImage } = require('@napi-rs/canvas');
module.exports = async function loadAssets(ENGINE, reelDir) {
  const dir = path.join(reelDir || __dirname, 'assets'), a = { cards: [null, null, null, null], post: null };
  for (let i = 0; i < 4; i++) { const p = path.join(dir, 'card' + (i + 1) + '.png'); if (fs.existsSync(p)) a.cards[i] = await loadImage(p); }
  const pp = path.join(dir, 'post.png'); if (fs.existsSync(pp)) a.post = await loadImage(pp);
  ENGINE.setAssets(a);
  return a;
};
