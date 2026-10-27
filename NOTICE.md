# Notices

## browser-jvm

The TypeScript sources (`src/`, `scripts/`, `test/`) and the Java sources
(`java/`) of this project are released under the MIT License, see
[LICENSE](LICENSE).

## OpenJDK classes in `jars/runtime.jar`

`jars/runtime.jar` combines this project's own class library (compiled
from `java/base/`) with unmodified class files taken from the `java.base`
module of OpenJDK 21, chosen by `scripts/buildRuntime.ts`.
`docs/RUNTIME.md` lists which classes are this project's and which are
OpenJDK's. The jar also contains OpenJDK's time zone database
(`lib/tzdb.dat`).

Those OpenJDK classes are licensed under the GNU General Public License,
version 2, with the Classpath Exception:

- [licenses/openjdk/GPL-2.0.txt](licenses/openjdk/GPL-2.0.txt)
- [licenses/openjdk/CLASSPATH_EXCEPTION.txt](licenses/openjdk/CLASSPATH_EXCEPTION.txt)
- [licenses/openjdk/ASSEMBLY_EXCEPTION](licenses/openjdk/ASSEMBLY_EXCEPTION)
- third-party notices that OpenJDK ships with `java.base`, in
  [licenses/openjdk/](licenses/openjdk)

Their source code is available from the OpenJDK project at
<https://github.com/openjdk/jdk21u>.

The Classpath Exception lets the runner and programs it runs link with
these classes without being covered by the GPL themselves.

## libGDX

`jars/gdx.jar` contains only this project's own implementations of the
`com.badlogic.gdx.backends.lwjgl3` classes (compiled from `java/gdx/`). It
is compiled against libGDX (Apache License 2.0) but does not include any
libGDX classes; games bring their own copy of libGDX.

## Games

No game is included in this repository. Shattered Pixel Dungeon, used to
test the runner, is GPL-3.0 and available from
<https://github.com/00-Evan/shattered-pixel-dungeon>.
