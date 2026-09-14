export const Cron = () => () => {};
export const CronExpression = {
  EVERY_HOUR: '0 0-23/1 * * *',
  EVERY_DAY_AT_MIDNIGHT: '0 0 * * *',
};
export const ScheduleModule = {
  forRoot: () => ({
    module: class ScheduleModuleMock {},
  }),
};
export const SchedulerRegistry = class {
  addCronJob() {}
  getCronJobs() { return new Map(); }
  deleteCronJob() {}
};