add_library(tragar_core STATIC
  tragar_core.cpp
)

target_include_directories(tragar_core PUBLIC ${CMAKE_CURRENT_SOURCE_DIR})
target_compile_features(tragar_core PUBLIC cxx_std_23)

target_compile_options(tragar_core PRIVATE
  $<$<CXX_COMPILER_ID:GNU>:-Wall -Wextra -Wpedantic>
  $<$<CXX_COMPILER_ID:Clang>:-Wall -Wextra -Wpedantic>
)
