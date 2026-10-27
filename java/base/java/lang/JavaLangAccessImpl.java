package java.lang;

final class JavaLangAccessImpl implements jdk.internal.access.JavaLangAccess {
    public java.util.List<java.lang.reflect.Method> getDeclaredPublicMethods(java.lang.Class<?> p0, java.lang.String p1, java.lang.Class<?>... p2) {
        java.util.List<java.lang.reflect.Method> list = new java.util.ArrayList<>(); for (java.lang.reflect.Method m : p0.getMethods()) if (m.getName().equals(p1) && java.util.Arrays.equals(m.getParameterTypes(), p2)) list.add(m); return list;
    }

    public jdk.internal.reflect.ConstantPool getConstantPool(java.lang.Class<?> p0) {
        throw new UnsupportedOperationException("JavaLangAccess.getConstantPool");
    }

    public boolean casAnnotationType(java.lang.Class<?> p0, sun.reflect.annotation.AnnotationType p1, sun.reflect.annotation.AnnotationType p2) {
        throw new UnsupportedOperationException("JavaLangAccess.casAnnotationType");
    }

    public sun.reflect.annotation.AnnotationType getAnnotationType(java.lang.Class<?> p0) {
        throw new UnsupportedOperationException("JavaLangAccess.getAnnotationType");
    }

    public java.util.Map<java.lang.Class<? extends java.lang.annotation.Annotation>, java.lang.annotation.Annotation> getDeclaredAnnotationMap(java.lang.Class<?> p0) {
        throw new UnsupportedOperationException("JavaLangAccess.getDeclaredAnnotationMap");
    }

    public byte[] getRawClassAnnotations(java.lang.Class<?> p0) {
        throw new UnsupportedOperationException("JavaLangAccess.getRawClassAnnotations");
    }

    public byte[] getRawClassTypeAnnotations(java.lang.Class<?> p0) {
        throw new UnsupportedOperationException("JavaLangAccess.getRawClassTypeAnnotations");
    }

    public byte[] getRawExecutableTypeAnnotations(java.lang.reflect.Executable p0) {
        throw new UnsupportedOperationException("JavaLangAccess.getRawExecutableTypeAnnotations");
    }

    public <E extends java.lang.Enum<E>> E[] getEnumConstantsShared(java.lang.Class<E> p0) {
        return p0.getEnumConstantsShared();
    }

    public void blockedOn(sun.nio.ch.Interruptible p0) {
        
    }

    public void registerShutdownHook(int p0, boolean p1, java.lang.Runnable p2) {
        Runtime.getRuntime().addShutdownHook(new Thread(p2));
    }

    public java.lang.Thread newThreadWithAcc(java.lang.Runnable p0, java.security.AccessControlContext p1) {
        throw new UnsupportedOperationException("JavaLangAccess.newThreadWithAcc");
    }

    public void invokeFinalize(java.lang.Object p0) throws java.lang.Throwable {
        
    }

    public java.util.concurrent.ConcurrentHashMap<?, ?> createOrGetClassLoaderValueMap(java.lang.ClassLoader p0) {
        throw new UnsupportedOperationException("JavaLangAccess.createOrGetClassLoaderValueMap");
    }

    public java.lang.Class<?> defineClass(java.lang.ClassLoader p0, java.lang.String p1, byte[] p2, java.security.ProtectionDomain p3, java.lang.String p4) {
        throw new UnsupportedOperationException("JavaLangAccess.defineClass");
    }

    public java.lang.Class<?> defineClass(java.lang.ClassLoader p0, java.lang.Class<?> p1, java.lang.String p2, byte[] p3, java.security.ProtectionDomain p4, boolean p5, int p6, java.lang.Object p7) {
        throw new UnsupportedOperationException("JavaLangAccess.defineClass");
    }

    public java.lang.Class<?> findBootstrapClassOrNull(java.lang.String p0) {
        throw new UnsupportedOperationException("JavaLangAccess.findBootstrapClassOrNull");
    }

    public java.lang.Package definePackage(java.lang.ClassLoader p0, java.lang.String p1, java.lang.Module p2) {
        throw new UnsupportedOperationException("JavaLangAccess.definePackage");
    }

    public java.lang.String fastUUID(long p0, long p1) {
        return uuid(p0, p1);
    }

    public void addNonExportedPackages(java.lang.ModuleLayer p0) {
        throw new UnsupportedOperationException("JavaLangAccess.addNonExportedPackages");
    }

    public void invalidatePackageAccessCache() {
        throw new UnsupportedOperationException("JavaLangAccess.invalidatePackageAccessCache");
    }

    public java.lang.Module defineModule(java.lang.ClassLoader p0, java.lang.module.ModuleDescriptor p1, java.net.URI p2) {
        throw new UnsupportedOperationException("JavaLangAccess.defineModule");
    }

    public java.lang.Module defineUnnamedModule(java.lang.ClassLoader p0) {
        throw new UnsupportedOperationException("JavaLangAccess.defineUnnamedModule");
    }

    public void addReads(java.lang.Module p0, java.lang.Module p1) {
        throw new UnsupportedOperationException("JavaLangAccess.addReads");
    }

    public void addReadsAllUnnamed(java.lang.Module p0) {
        throw new UnsupportedOperationException("JavaLangAccess.addReadsAllUnnamed");
    }

    public void addExports(java.lang.Module p0, java.lang.String p1) {
        throw new UnsupportedOperationException("JavaLangAccess.addExports");
    }

    public void addExports(java.lang.Module p0, java.lang.String p1, java.lang.Module p2) {
        throw new UnsupportedOperationException("JavaLangAccess.addExports");
    }

    public void addExportsToAllUnnamed(java.lang.Module p0, java.lang.String p1) {
        throw new UnsupportedOperationException("JavaLangAccess.addExportsToAllUnnamed");
    }

    public void addOpens(java.lang.Module p0, java.lang.String p1, java.lang.Module p2) {
        throw new UnsupportedOperationException("JavaLangAccess.addOpens");
    }

    public void addOpensToAllUnnamed(java.lang.Module p0, java.lang.String p1) {
        throw new UnsupportedOperationException("JavaLangAccess.addOpensToAllUnnamed");
    }

    public void addOpensToAllUnnamed(java.lang.Module p0, java.util.Set<java.lang.String> p1, java.util.Set<java.lang.String> p2) {
        throw new UnsupportedOperationException("JavaLangAccess.addOpensToAllUnnamed");
    }

    public void addUses(java.lang.Module p0, java.lang.Class<?> p1) {
        throw new UnsupportedOperationException("JavaLangAccess.addUses");
    }

    public boolean isReflectivelyExported(java.lang.Module p0, java.lang.String p1, java.lang.Module p2) {
        throw new UnsupportedOperationException("JavaLangAccess.isReflectivelyExported");
    }

    public boolean isReflectivelyOpened(java.lang.Module p0, java.lang.String p1, java.lang.Module p2) {
        return true;
    }

    public java.lang.Module addEnableNativeAccess(java.lang.Module p0) {
        throw new UnsupportedOperationException("JavaLangAccess.addEnableNativeAccess");
    }

    public void addEnableNativeAccessToAllUnnamed() {
        
    }

    public void ensureNativeAccess(java.lang.Module p0, java.lang.Class<?> p1, java.lang.String p2) {
        throw new UnsupportedOperationException("JavaLangAccess.ensureNativeAccess");
    }

    public jdk.internal.module.ServicesCatalog getServicesCatalog(java.lang.ModuleLayer p0) {
        throw new UnsupportedOperationException("JavaLangAccess.getServicesCatalog");
    }

    public void bindToLoader(java.lang.ModuleLayer p0, java.lang.ClassLoader p1) {
        throw new UnsupportedOperationException("JavaLangAccess.bindToLoader");
    }

    public java.util.stream.Stream<java.lang.ModuleLayer> layers(java.lang.ModuleLayer p0) {
        throw new UnsupportedOperationException("JavaLangAccess.layers");
    }

    public java.util.stream.Stream<java.lang.ModuleLayer> layers(java.lang.ClassLoader p0) {
        throw new UnsupportedOperationException("JavaLangAccess.layers");
    }

    public int countPositives(byte[] p0, int p1, int p2) {
        int n = 0; while (n < p2 && p0[p1 + n] >= 0) n++; return n;
    }

    public java.lang.String newStringNoRepl(byte[] p0, java.nio.charset.Charset p1) throws java.nio.charset.CharacterCodingException {
        return new String(p0, p1);
    }

    public byte[] getBytesNoRepl(java.lang.String p0, java.nio.charset.Charset p1) throws java.nio.charset.CharacterCodingException {
        return p0.getBytes(p1);
    }

    public java.lang.String newStringUTF8NoRepl(byte[] p0, int p1, int p2) {
        return new String(p0, p1, p2, java.nio.charset.StandardCharsets.UTF_8);
    }

    public char getUTF16Char(byte[] p0, int p1) {
        throw new UnsupportedOperationException("JavaLangAccess.getUTF16Char");
    }

    public byte[] getBytesUTF8NoRepl(java.lang.String p0) {
        return p0.getBytes(java.nio.charset.StandardCharsets.UTF_8);
    }

    public void inflateBytesToChars(byte[] p0, int p1, char[] p2, int p3, int p4) {
        for (int i = 0; i < p4; i++) p2[p3 + i] = (char) (p0[p1 + i] & 0xff);
    }

    public int decodeASCII(byte[] p0, int p1, char[] p2, int p3, int p4) {
        int n = 0; while (n < p4 && p0[p1 + n] >= 0) { p2[p3 + n] = (char) p0[p1 + n]; n++; } return n;
    }

    public java.io.InputStream initialSystemIn() {
        throw new UnsupportedOperationException("JavaLangAccess.initialSystemIn");
    }

    public int encodeASCII(char[] p0, int p1, byte[] p2, int p3, int p4) {
        int n = 0; while (n < p4 && p0[p1 + n] < 0x80) { p2[p3 + n] = (byte) p0[p1 + n]; n++; } return n;
    }

    public void setCause(java.lang.Throwable p0, java.lang.Throwable p1) {
        throw new UnsupportedOperationException("JavaLangAccess.setCause");
    }

    public java.security.ProtectionDomain protectionDomain(java.lang.Class<?> p0) {
        throw new UnsupportedOperationException("JavaLangAccess.protectionDomain");
    }

    public java.lang.invoke.MethodHandle stringConcatHelper(java.lang.String p0, java.lang.invoke.MethodType p1) {
        throw new UnsupportedOperationException("JavaLangAccess.stringConcatHelper");
    }

    public long stringConcatInitialCoder() {
        throw new UnsupportedOperationException("JavaLangAccess.stringConcatInitialCoder");
    }

    public long stringConcatMix(long p0, java.lang.String p1) {
        throw new UnsupportedOperationException("JavaLangAccess.stringConcatMix");
    }

    public long stringConcatCoder(char p0) {
        throw new UnsupportedOperationException("JavaLangAccess.stringConcatCoder");
    }

    public long stringBuilderConcatMix(long p0, java.lang.StringBuilder p1) {
        throw new UnsupportedOperationException("JavaLangAccess.stringBuilderConcatMix");
    }

    public long stringBuilderConcatPrepend(long p0, byte[] p1, java.lang.StringBuilder p2) {
        throw new UnsupportedOperationException("JavaLangAccess.stringBuilderConcatPrepend");
    }

    public java.lang.String join(java.lang.String p0, java.lang.String p1, java.lang.String p2, java.lang.String[] p3, int p4) {
        StringBuilder sb = new StringBuilder(p0); for (int i = 0; i < p4; i++) { if (i > 0) sb.append(p2); sb.append(p3[i]); } return sb.append(p1).toString();
    }

    public java.lang.Object classData(java.lang.Class<?> p0) {
        throw new UnsupportedOperationException("JavaLangAccess.classData");
    }

    public long findNative(java.lang.ClassLoader p0, java.lang.String p1) {
        throw new UnsupportedOperationException("JavaLangAccess.findNative");
    }

    public void exit(int p0) {
        throw new UnsupportedOperationException("JavaLangAccess.exit");
    }

    public java.lang.Thread[] getAllThreads() {
        throw new UnsupportedOperationException("JavaLangAccess.getAllThreads");
    }

    public jdk.internal.vm.ThreadContainer threadContainer(java.lang.Thread p0) {
        return null;
    }

    public void start(java.lang.Thread p0, jdk.internal.vm.ThreadContainer p1) {
        p0.start();
    }

    public jdk.internal.vm.StackableScope headStackableScope(java.lang.Thread p0) {
        return null;
    }

    public void setHeadStackableScope(jdk.internal.vm.StackableScope p0) {
        throw new UnsupportedOperationException("JavaLangAccess.setHeadStackableScope");
    }

    public java.lang.Thread currentCarrierThread() {
        return Thread.currentThread();
    }

    public <V> V executeOnCarrierThread(java.util.concurrent.Callable<V> p0) throws java.lang.Exception {
        throw new UnsupportedOperationException("JavaLangAccess.executeOnCarrierThread");
    }

    public <T> T getCarrierThreadLocal(jdk.internal.misc.CarrierThreadLocal<T> p0) {
        return p0.get();
    }

    public <T> void setCarrierThreadLocal(jdk.internal.misc.CarrierThreadLocal<T> p0, T p1) {
        p0.set(p1);
    }

    public void removeCarrierThreadLocal(jdk.internal.misc.CarrierThreadLocal<?> p0) {
        p0.remove();
    }

    public boolean isCarrierThreadLocalPresent(jdk.internal.misc.CarrierThreadLocal<?> p0) {
        return true;
    }

    public java.lang.Object[] scopedValueCache() {
        throw new UnsupportedOperationException("JavaLangAccess.scopedValueCache");
    }

    public void setScopedValueCache(java.lang.Object[] p0) {
        throw new UnsupportedOperationException("JavaLangAccess.setScopedValueCache");
    }

    public java.lang.Object scopedValueBindings() {
        throw new UnsupportedOperationException("JavaLangAccess.scopedValueBindings");
    }

    public jdk.internal.vm.Continuation getContinuation(java.lang.Thread p0) {
        throw new UnsupportedOperationException("JavaLangAccess.getContinuation");
    }

    public void setContinuation(java.lang.Thread p0, jdk.internal.vm.Continuation p1) {
        throw new UnsupportedOperationException("JavaLangAccess.setContinuation");
    }

    public jdk.internal.vm.ContinuationScope virtualThreadContinuationScope() {
        throw new UnsupportedOperationException("JavaLangAccess.virtualThreadContinuationScope");
    }

    public void parkVirtualThread() {
        throw new UnsupportedOperationException("JavaLangAccess.parkVirtualThread");
    }

    public void parkVirtualThread(long p0) {
        throw new UnsupportedOperationException("JavaLangAccess.parkVirtualThread");
    }

    public void unparkVirtualThread(java.lang.Thread p0) {
        throw new UnsupportedOperationException("JavaLangAccess.unparkVirtualThread");
    }

    public java.lang.StackWalker newStackWalkerInstance(java.util.Set<java.lang.StackWalker.Option> p0, jdk.internal.vm.ContinuationScope p1, jdk.internal.vm.Continuation p2) {
        throw new UnsupportedOperationException("JavaLangAccess.newStackWalkerInstance");
    }

    public java.lang.String getLoaderNameID(java.lang.ClassLoader p0) {
        throw new UnsupportedOperationException("JavaLangAccess.getLoaderNameID");
    }

    public boolean allowSecurityManager() {
        throw new UnsupportedOperationException("JavaLangAccess.allowSecurityManager");
    }

    private static String uuid(long lsb, long msb) {
        return digits(msb >> 32, 8) + "-" + digits(msb >> 16, 4) + "-" + digits(msb, 4) + "-" + digits(lsb >> 48, 4) + "-" + digits(lsb, 12);
    }

    private static String digits(long val, int digits) {
        long hi = 1L << (digits * 4);
        return Long.toHexString(hi | (val & (hi - 1))).substring(1);
    }
}
