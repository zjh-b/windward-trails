# 风野奇旅 Implementation Plan

**Goal:** 交付沿用现有美术的三关横版小游戏。
**Architecture:** 原创 3D 素材烘焙；独立可测试物理状态；Canvas 渲染与 DOM 菜单；纯本地资源。
**Tech Stack:** Blender 4.5 / Python / Pillow / JavaScript / Canvas / Node test / Playwright。
**Spec:** DESIGN.md

## Tasks
- [x] 导出三张无角色背景、12 帧旅行者及猫动画，制作透明图集和环境声音。
- [x] tests/core.test.cjs 先定义落地、跳跃、缓存、金币、踩敌人、伤害、检查点、暂停与三关可达性；core.js 实现物理和关卡。
- [x] index.html / style.css / game.js 实现游戏、菜单、HUD、视差、音效、触屏、全屏、暂停和结算。
- [x] 用真实键盘及触摸流程做浏览器测试，检查控制台与截图；修复观测到的问题。
- [x] 编写 Python 启动器、README，校验离线入口、素材和 ZIP。

## Review focus
- 长帧及窗口失焦不导致穿地或按键卡住。
- 重试、换关和暂停不遗留旧状态。
- 检查点位置安全；金币不重复获取。
- 普通跳跃可跨过全部必经缺口。
- 本地 file:// 与 HTTP 均可加载，不依赖网络资源。
