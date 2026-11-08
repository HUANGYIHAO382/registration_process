# 数字人动画方案说明（给产品 / 美术）

## 现在 Demo 用什么？

默认 **`maodie-sheet`**：开源橘猫精灵图集，**真·帧动画**播 idle（不再两张立绘来回淡入）。

高清立绘包 `anan-hd-cat` 仍保留，但待机改为 **单帧 + CSS 呼吸**，不再互切。

---

## Spine 可不可以用？

**可以，但是下一阶段更合适。**

| 项 | 说明 |
|---|---|
| 优点 | 骨骼驱动：呼吸、眨眼、耳朵、说话非常自然 |
| 需要 | Spine Editor（收费）导出 `.json/.skel + .atlas + 贴图` |
| 前端 | 官方 `spine-ts` / `spine-webgl` / `spine-player`（运行时免费，编辑器收费） |
| Demo 成本 | 要有人做绑骨与动画剪辑，工期明显长于图集 |

结论：网页 Demo 先用图集 / Lottie；定妆后若要「电影级」口型与微表情，再上 Spine。

---

## 比乱生成单图更好的 AI / 工具

| 工具 | 适合做什么 |
|---|---|
| [PixelLab](https://pixellab.ai/) | 直接出游戏精灵图集、动作帧 |
| [Scenario](https://www.scenario.com/) | 角色一致性 + 精灵流水线 |
| [LottieFiles](https://lottiefiles.com/) | 现成矢量动画（idle 很自然，可商用看许可证） |
| [Rive](https://rive.app/) | 交互式骨骼风动画，Web 友好 |
| Midjourney / 即梦等 | 只适合定妆，**不适合**直接当连续动画帧 |

原则：**连续动作要用同一绑定/同一图集**，不要把多张独立文生图当 idle 循环。

---

## 开源素材（已接入）

- [maodie-codex-pet](https://github.com/Octane0411/maodie-codex-pet)（MIT / 资源 CC BY 4.0）  
  路径：`public/sprites/maodie-sheet/`

切换回高清立绘：改 `src/modules/avatar/identity.js`：

```js
packId: 'anan-hd-cat',
engine: 'sprite',
```
