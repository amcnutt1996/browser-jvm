package java.lang.invoke;

/**
 * Field and array element handles. Access modes are signature-polymorphic and
 * are dispatched by the interpreter, so none of them is declared here.
 */
public abstract class VarHandle {
    final Class<?> varType;

    VarHandle(Class<?> varType) {
        this.varType = varType;
    }

    static final class FieldHandle extends VarHandle {
        FieldHandle(Class<?> owner, String name, Class<?> type, boolean isStatic) {
            super(type);
            init(owner, name, isStatic);
        }

        private native void init(Class<?> owner, String name, boolean isStatic);
    }

    static final class ArrayHandle extends VarHandle {
        ArrayHandle(Class<?> arrayClass) {
            super(arrayClass.getComponentType());
            init();
        }

        private native void init();
    }

    public Class<?> varType() {
        return varType;
    }

    public VarHandle withInvokeExactBehavior() {
        return this;
    }

    public VarHandle withInvokeBehavior() {
        return this;
    }

    public boolean hasInvokeExactBehavior() {
        return false;
    }

    public static void fullFence() {
    }

    public static void acquireFence() {
    }

    public static void releaseFence() {
    }

    public static void loadLoadFence() {
    }

    public static void storeStoreFence() {
    }
}
