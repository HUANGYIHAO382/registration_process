# 下游 AI 交接单 · 安安角色帧

> 用途：把本目录交给任何图像生成模型前，**整份附上**。目标不是"画一只好看的猫"，而是"补帧且构图零漂移"。

---

## 1. 一句话任务

锁定同一只猫（同花纹、同围巾、同吊牌、同坐姿、同画布构图），**只改表情与嘴型**，其余像素级保持。

---

## 2. 硬规格（按现有 6 帧实测，勿自行改）

| 项 | 值 | 说明 |
|---|---|---|
| 画布 | **864 × 1152**（3:4 竖版） | 现有成品帧的统一尺寸 |
| 背景 | 全透明（RGBA，colortype 6） | 不接受白底、绿幕、渐变 |
| 角色占宽 | 画布宽度的 **80%～83%** | 实测 bbox 宽 689–719px |
| 角色底边 | **贴画布底边，留白 0px** | 前端按 `object-position: center bottom` 对齐，留白会导致切帧上跳 |
| 角色重心 | 横向落在画布中心 **±6px** 内 | 超出会在切换时横向漂移 |
| 图像内文字 | **禁止任何可读文字**（中英文皆禁） | 吊牌只保留爪印图形 |
| 光照 | 左上方主光，柔和暖调 | 与现有帧一致，禁止换光 |

> ⚠️ `public/sprites/anan-hd-cat/meta.json` 里写的是 `768×1024`，与实际素材 `864×1152` 不符（比例同为 3:4，前端 `object-fit: contain` 兜住了，但**不要按 meta 出图**，以本表 864×1152 为准）。

---

## 3. 参考图用途（重要：不是每张都能喂）

| 文件 | 能不能当生成参考 | 说明 |
|---|---|---|
| `01-idle-主参考.png` | ⚠️ **只能当花纹/配色/脸部细节参考** | 480×504，画布比例与成品不符（0.95:1 vs 0.75:1）；**底部烧进了一个"安安"灰色胶囊标签**，属于截图残留的 UI 元素，不是角色特征，必须忽略。若拿它当唯一构图锚点，新帧会比现有帧"猫更小、留白更多"，拼不上。 |
| `02-idle-参考2.png` | ✅ **推荐作为构图 + 风格主锚点** | 864×1152，idle 态，重心/尺度与其余成品帧最接近 |
| `03` `04` `05` `06` `07` | ✅ 可作"同一批"参考 | 用于理解动作幅度与嘴型开口度，勿单独当构图基准 |
| `00-用户截图参考.png` | ❌ **禁止** | RGB 无透明通道 + 深绿背景 + UI 标签，进流水线必污染 |
| `08-开源图集-maodie-spritesheet.webp` | ⚠️ 仅节奏参考 | 那是另一只猫（耄耋）。**只学动作节拍与帧数，禁止学造型** |

**建议投喂顺序**：`02`（构图+风格）→ `01`（脸部/围巾/条纹细节）→ 目标嘴型帧（如补嘴型时给 `05`）。

---

## 4. 角色锁定描述（直接贴进 prompt 开头）

```
A chubby orange tabby kitten mascot, identical character sheet lock:
same warm ginger fur with dark orange tabby stripes on forehead forming an "M",
same cream-white muzzle, chest and paw tips, same pink nose,
same rosy blush cheeks, same large amber-brown eyes with dark rim,
same teal (#2E8B8B) chunky knit scarf wrapped twice with one long tail hanging
down the left side, same round gold-rimmed pendant with a white paw-print icon,
same seated pose with front paws together, tail curled to the right,
same soft 3D storybook render, soft fur detail, warm top-left key light.
```

## 5. 逐帧改法（一次只改一处）

| 目标帧 | 只允许改 | 其余必须不动 |
|---|---|---|
| idle | 眼睛睁开、嘴闭合微笑 | 位置、大小、围巾褶皱 |
| listen | 眼睛睁大偏右上看、耳朵微前倾 | 身体与围巾 |
| alert | 眉毛下压、眼睛圆睁、嘴微撇 | 身体与围巾 |
| mouth-a | **仅嘴部张开露舌** | 眼型、头角度、身体 |
| mouth-o | **仅嘴唇收圆成 O** | 其余全部 |
| mouth-m | **仅双唇闭合** | 其余全部 |

> 嘴型帧是整图替换后做 220ms 交叉淡入，**头角度偏移 1° 都会看出来**。给嘴型帧时，务必以同一张 idle 为底做局部修改，不要重新构图。

## 6. 负面提示词

```
text, letters, chinese characters, watermark, signature, logo, UI label, badge overlay,
nurse hat, medical cross, stethoscope, hospital uniform,
different cat, different scarf color, scarf missing, pendant missing,
standing pose, walking, full body side view, cropped paws, cut off ears,
white background, green screen, gradient background, drop shadow baked in,
photorealistic, harsh contrast, extra limbs, deformed paws
```

## 7. 交付前必须跑一次

```bash
python scripts/verify_sprite_frames.py public/sprites/reference-for-ai --base=02-idle-参考2.png
```

全部 `PASS` 才算通过。该项检查：画布尺寸一致、重心横向 ≤6px、底边留白差 ≤2px、身高偏差 ≤1.5%。

---

## 8. 当前已知待修（2026-11-08 实测）

| 帧 | 问题 | 建议 |
|---|---|---|
| `01-idle-主参考` | 480×504；底部含"安安"UI 标签 | 重新从原图抠，或改用 `02` 当主参考 |
| `03-listen` | 重心比基准偏左 19px | 右移 19px 或重生成 |
| `07-mouth-m` | 底边留白 11px（其余帧 0）；身高小 1.8% | 重生成，或后处理「放大 1.8% + 底部对齐」 |

> "安安"标签残留的根因：`scripts/remove_sprite_bg.py` 用的是**边缘洪水填充**，只清与四边连通的背景。标签被猫身包裹、不与画布边缘连通，因此被判定为"角色内部"而保留。修复需在抠图后追加一步「内部 UI 元素检测」或改人工擦除。
