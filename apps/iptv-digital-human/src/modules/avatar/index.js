/**
 * 数字人模块出口
 * 默认：安安 v3 分层精灵（眨眼 / 抖耳 / 摆尾）
 */
export { Avatar } from './AvatarEngine.js'
export { SpriteAvatar } from './SpriteAvatarEngine.js'
export { SheetAvatar } from './SheetAvatarEngine.js'
export { LayeredSpriteAvatar } from './LayeredSpriteAvatar.js'
export { AVATAR_IDENTITY } from './identity.js'

import { Avatar } from './AvatarEngine.js'
import { SpriteAvatar } from './SpriteAvatarEngine.js'
import { SheetAvatar } from './SheetAvatarEngine.js'
import { LayeredSpriteAvatar } from './LayeredSpriteAvatar.js'
import { AVATAR_IDENTITY } from './identity.js'

/**
 * @param {HTMLElement} host
 * @param {{ engine?: string, packId?: string, kind?: string }} options
 */
export function createAvatar(host, options = {}) {
  const engine = options.engine || AVATAR_IDENTITY.engine || 'layered'
  const packId = options.packId || AVATAR_IDENTITY.packId

  if (engine === 'svg') {
    return new Avatar(host, options.kind || AVATAR_IDENTITY.kind || 'cat')
  }
  if (engine === 'sheet') {
    return new SheetAvatar(host, { packId: packId || 'maodie-sheet' })
  }
  if (engine === 'sprite') {
    return new SpriteAvatar(host, { packId: packId || 'anan-hd-cat' })
  }
  // layered（默认）
  return new LayeredSpriteAvatar(host, { packId: packId || 'anan-cat-v3' })
}
