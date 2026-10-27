import {
  type JArray,
  type JClass,
  type JObject,
  type JThread,
  type Monitor,
  type Request,
} from "./types.ts";
import { type JVM } from "./vm.ts";

export type Lockable = JArray | JClass | JObject | string;

const stringMonitors = new Map<string, Monitor>();

export const monitorOf = (target: Lockable): Monitor => {
  if (typeof target === "string") {
    let monitor = stringMonitors.get(target);

    if (!monitor) {
      monitor = { count: 0, entrants: [], owner: undefined, waiters: new Set() };
      stringMonitors.set(target, monitor);
    }

    return monitor;
  }

  if (!target.$mon) {
    target.$mon = {
      count: 0,
      entrants: [],
      owner: undefined,
      waiters: new Set(),
    };
  }

  return target.$mon;
};

export const tryEnter = (thread: JThread, target: Lockable): boolean => {
  const monitor = monitorOf(target);

  if (monitor.owner === undefined) {
    monitor.owner = thread;
    monitor.count = 1;

    return true;
  }

  if (monitor.owner === thread) {
    monitor.count++;

    return true;
  }

  return false;
};

export const enter = function* enter(
  vm: JVM,
  thread: JThread,
  target: Lockable
): Generator<Request, void, unknown> {
  while (!tryEnter(thread, target)) {
    const monitor = monitorOf(target);

    yield vm.wait(
      new Promise<void>((resolve) => {
        monitor.entrants.push(resolve);
      })
    );
  }
}

const release = (monitor: Monitor): void => {
  monitor.owner = undefined;
  monitor.count = 0;

  const next = monitor.entrants.shift();

  if (next) next();
};

export const exit = (vm: JVM, thread: JThread, target: Lockable): void => {
  const monitor = monitorOf(target);

  if (monitor.owner !== thread) {
    vm.throwNew("java/lang/IllegalMonitorStateException");
  }

  if (--monitor.count === 0) release(monitor);
};

export const wait = function* wait(
  vm: JVM,
  thread: JThread,
  target: Lockable,
  millis: number
): Generator<Request, void, unknown> {
  const monitor = monitorOf(target);

  if (monitor.owner !== thread) {
    vm.throwNew(
      "java/lang/IllegalMonitorStateException",
      "current thread is not owner"
    );
  }

  if (thread.interrupted) {
    thread.interrupted = false;
    vm.throwNew("java/lang/InterruptedException");
  }

  const { count } = monitor;

  release(monitor);

  let notified: (() => void) | undefined;
  let cancel: (() => void) | undefined;

  yield vm.wait(
    new Promise<void>((resolve) => {
      notified = () => {
        monitor.waiters.delete(notified as () => void);
        thread.interruptWaiter = undefined;

        cancel?.();

        resolve();
      };
      monitor.waiters.add(notified);
      thread.interruptWaiter = notified;

      if (millis > 0) cancel = vm.setTimer(notified, millis);
    })
  );

  yield* enter(vm, thread, target);
  monitor.count = count;

  if (thread.interrupted) {
    thread.interrupted = false;
    vm.throwNew("java/lang/InterruptedException");
  }
}

export const notify = (
  vm: JVM,
  thread: JThread,
  target: Lockable,
  all: boolean
): void => {
  const monitor = monitorOf(target);

  if (monitor.owner !== thread) {
    vm.throwNew(
      "java/lang/IllegalMonitorStateException",
      "current thread is not owner"
    );
  }

  for (const waiter of monitor.waiters) {
    waiter();

    if (!all) break;
  }
};
