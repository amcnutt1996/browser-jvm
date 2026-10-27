package java.lang;

import java.util.Objects;

public final class StackTraceElement implements java.io.Serializable {
    private final String declaringClass;
    private final String methodName;
    private final String fileName;
    private final int lineNumber;

    public StackTraceElement(String declaringClass, String methodName, String fileName, int lineNumber) {
        this.declaringClass = Objects.requireNonNull(declaringClass, "Declaring class is null");
        this.methodName = Objects.requireNonNull(methodName, "Method name is null");
        this.fileName = fileName;
        this.lineNumber = lineNumber;
    }

    public StackTraceElement(String classLoaderName, String moduleName, String moduleVersion, String declaringClass, String methodName, String fileName, int lineNumber) {
        this(declaringClass, methodName, fileName, lineNumber);
    }

    public String getFileName() {
        return fileName;
    }

    public int getLineNumber() {
        return lineNumber;
    }

    public String getModuleName() {
        return null;
    }

    public String getModuleVersion() {
        return null;
    }

    public String getClassLoaderName() {
        return null;
    }

    public String getClassName() {
        return declaringClass;
    }

    public String getMethodName() {
        return methodName;
    }

    public boolean isNativeMethod() {
        return lineNumber == -2;
    }

    public String toString() {
        String location;
        if (isNativeMethod()) {
            location = "Native Method";
        } else if (fileName == null) {
            location = "Unknown Source";
        } else if (lineNumber >= 0) {
            location = fileName + ":" + lineNumber;
        } else {
            location = fileName;
        }
        return declaringClass + "." + methodName + "(" + location + ")";
    }

    public boolean equals(Object obj) {
        if (obj == this) {
            return true;
        }
        if (!(obj instanceof StackTraceElement)) {
            return false;
        }
        StackTraceElement e = (StackTraceElement) obj;
        return e.lineNumber == lineNumber && Objects.equals(declaringClass, e.declaringClass) && Objects.equals(methodName, e.methodName) && Objects.equals(fileName, e.fileName);
    }

    public int hashCode() {
        int result = 31 * declaringClass.hashCode() + methodName.hashCode();
        result = 31 * result + Objects.hashCode(fileName);
        result = 31 * result + lineNumber;
        return result;
    }
}
