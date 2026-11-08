/**
 * 数字人模块出口
 * 默认：开源精灵图集真帧动画；可切高清立绘 / SVG
 */
export { Avatar } from './AvatarEngine.js'
export { SpriteAvatar } from './SpriteAvatarEngine.js'
export { SheetAvatar } from './SheetAvatarEngine.js'
export { AVATAR_IDENTITY } from './identity.js'

import { Avatar } from './AvatarEngine.js'
import { SpriteAvatar } from './SpriteAvatarEngine.js'
import { SheetAvatar } from './SheetAvatarEngine.js'
import { AVATAR_IDENTITY } from './identity.js'

/**
 * @param {HTMLElement} host
 * @param {{ engine?: 'sheet'|'sprite'|'svg', packId?: string, kind?: string }} options
 */
export function createAvatar(host, options = {}) {
  const engine = options.engine || AVATAR_IDENTITY.engine || 'sheet'
  const packId = options.packId || AVATAR_IDENTITY.packId

  if (engine === 'svg') {
    return new Avatar(host, options.kind || AVATAR_IDENTITY.kind || 'cat')
  }
  if (engine === 'sprite') {
    return new SpriteAvatar(host, { packId: packId || 'anan-hd-cat' })
  }
  return new SheetAvatar(host, { packId: packId || 'maodie-sheet' })
}
