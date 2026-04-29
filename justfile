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
    npm install --prefix js

# Type-check TypeScript
ts-check:
    npx --prefix js tsc --noEmit

# Clean build artifacts
clean:
    rm -rf build dist
