export class Pausable {
  protected paused: Promise<void> = Promise.resolve()
  public resume: (value?: Promise<void>) => void = () => {}

  public pause(): void {
    this.resume(
      // biome-ignore lint/suspicious/noAssignInExpressions:
      (this.paused = new Promise((resolve) => {
        this.resume = resolve
      })),
    )
  }
}
