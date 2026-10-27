import {
  ERRONEOUS,
  INITIALIZED,
  INITIALIZING,
  JavaThrow,
  type JClass,
  type JThread,
  type Request,
} from "./types.ts";
import { type JVM } from "./vm.ts";

const finish = (cls: JClass, state: number): void => {
  cls.state = state;
  cls.initThread = undefined;

  for (const waiter of cls.initWaiters) waiter();

  cls.initWaiters = [];
};

export const initialize = function* initialize(
  vm: JVM,
  thread: JThread,
  cls: JClass
): Generator<Request, void, unknown> {
  for (;;) {
    if (cls.state === INITIALIZED) return;

    if (cls.state === ERRONEOUS) {
      vm.throwNew(
        "java/lang/NoClassDefFoundError",
        `Could not initialize class ${cls.name.replaceAll("/", ".")}`
      );
    }

    if (cls.state !== INITIALIZING) break;

    if (cls.initThread === thread) return;

    yield vm.wait(
      new Promise<void>((resolve) => {
        cls.initWaiters.push(resolve);
      })
    );
  }

  cls.state = INITIALIZING;
  cls.initThread = thread;

  try {
    if (cls.superClass && cls.superClass.state !== INITIALIZED) {
      yield* initialize(vm, thread, cls.superClass);
    }

    if (!cls.isInterface) {
      for (const iface of cls.interfaces) {
        if (
          iface.state !== INITIALIZED &&
          iface.declaredMethods.some(
            (method) => !method.isAbstract && !method.isStatic
          )
        ) {
          yield* initialize(vm, thread, iface);
        }
      }
    }

    const clinit = cls.methodMap.get("<clinit>()V");

    if (clinit) yield vm.invoke(clinit, []);
  } catch (error) {
    finish(cls, ERRONEOUS);

    if (
      error instanceof JavaThrow &&
      !error.exception.$cls.isSubclassOf(vm.loadClass("java/lang/Error"))
    ) {
      const wrapper = vm.newThrowable(
        "java/lang/ExceptionInInitializerError"
      );

      wrapper._cause = error.exception;
      wrapper._exception = error.exception;
      throw new JavaThrow(wrapper);
    }

    throw error;
  }

  finish(cls, INITIALIZED);
}
