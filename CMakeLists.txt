cmake_minimum_required(VERSION 3.25)
project(tragar VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

include(CTest)

add_subdirectory(src/core)

if(BUILD_TESTING)
  add_subdirectory(tests/native)
endif()

if(EMSCRIPTEN)
  add_subdirectory(src/bind)
endif()
