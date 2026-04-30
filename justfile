# tRAGar — task runner
# Usage: just <recipe>

# Show available recipes
default:
    @just --list

# Configure CMake (native, debug)
configure:
    cmake --preset debug

# Build native (debug)
build:
    cmake --build build/debug

# Run native unit tests
test:
    ctest --test-dir build/debug --output-on-failure

# Configure WASM build
configure-wasm:
    emcmake cmake --preset wasm

# Build WASM
build-wasm:
    cmake --build build/wasm

# Run benchmarks
bench:
    cmake --build build/debug --target bench && ./build/debug/bench/bench_all

# Format all C++ sources
fmt:
    find src -name '*.cpp' -o -name '*.h' | xargs clang-format -i

# Lint C++ sources
lint:
    find src -name '*.cpp' -o -name '*.h' | xargs clang-tidy

# Install JS dependencies
js-install:
    bun install --cwd js

# Type-check TypeScript
ts-check:
    bun run --cwd js type-check

# Run JS tests
test-js:
    bun test js/tests/

# Compile and run native C++ tests without cmake (requires g++-15)
test-native-direct:
    g++-15 -std=c++23 -I src/core \
        tests/native/test_bootstrap.cpp src/core/tragar_core.cpp \
        -I tests/native \
        -o /tmp/tragar_test_bootstrap && /tmp/tragar_test_bootstrap

# Clean build artifacts
clean:
    rm -rf build dist
