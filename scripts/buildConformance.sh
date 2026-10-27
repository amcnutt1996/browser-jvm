#!/bin/sh
# Compiles the Java runner conformance programs and records their output on a
# real JVM. Run from the repository root; needs a JDK 11 or newer.
set -e
dir=test/conformance
rm -rf "$dir/classes" "$dir/expected"
mkdir -p "$dir/classes" "$dir/expected"
javac -nowarn --release 11 -encoding UTF-8 -d "$dir/classes" "$dir"/src/*.java
for source in "$dir"/src/*.java; do
  name=$(basename "$source" .java)
  rm -rf /tmp/iotest
  set +e
  LANG=C.UTF-8 JAVA_TOOL_OPTIONS= java -Dstdout.encoding=UTF-8 -Dstderr.encoding=UTF-8 -Dfile.encoding=UTF-8 -Duser.language=en -Duser.country= -cp "$dir/classes" "$name" > "$dir/expected/$name.out" 2> "$dir/expected/$name.err"
  echo $? > "$dir/expected/$name.code"
  set -e
done
