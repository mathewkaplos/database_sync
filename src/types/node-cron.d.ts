declare module "node-cron" {
  interface ScheduleOptions {
    scheduled?: boolean;
    timezone?: string;
  }

  type Task = {
    start: () => void;
    stop: () => void;
  };

  function schedule(
    expression: string,
    func: () => void | Promise<void>,
    options?: ScheduleOptions
  ): Task;

  function validate(expression: string): boolean;

  export { schedule, validate, ScheduleOptions, Task };
}
