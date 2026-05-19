import type { UIContext } from '../UIOverlay'
import { HUDPanel } from './HUDPanel'
import { HealthBar } from './HealthBar'
import { MenuScreen } from './MenuScreen'

export class UIRoot {
  private hudPanel: HUDPanel
  private healthBar: HealthBar
  private menuScreen: MenuScreen

  constructor(root: HTMLElement, maxHealth: number) {
    this.hudPanel = new HUDPanel(root)
    this.healthBar = new HealthBar(root, maxHealth)
    this.menuScreen = new MenuScreen(root)
  }

  update(ctx: UIContext): void {
    // Menu screens for non-gameplay states
    if (ctx.state === 'Countdown') {
      this.hudPanel.hide()
      this.healthBar.hide()
      this.menuScreen.showCountdown(ctx.countdown)
      return
    }

    if (ctx.state === 'Playing') {
      this.menuScreen.hide()
      this.hudPanel.show()
      this.healthBar.show()
      this.hudPanel.update(ctx)
      this.healthBar.update(ctx)
      return
    }

    // All other states: show menu screen, hide HUD
    this.hudPanel.hide()
    this.healthBar.hide()
    this.menuScreen.update(ctx)

    // Special: update calibration progress bar in real-time
    if (ctx.state === 'Calibration') {
      this.menuScreen.updateCalibrationProgress(ctx)
    }
  }

  dispose(): void {
    this.hudPanel.dispose()
    this.healthBar.dispose()
    this.menuScreen.dispose()
  }
}
