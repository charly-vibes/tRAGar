add_executable(tragar_wasm bindings.cpp)

target_link_libraries(tragar_wasm PRIVATE tragar_core)

target_link_options(tragar_wasm PRIVATE
  -sEXPORT_ES6=1
  -sMODULARIZE=1
  -sEXPORT_NAME=createTRAGarModule
  -sALLOW_MEMORY_GROWTH=1
  -sBIND
)

set_target_properties(tragar_wasm PROPERTIES
  OUTPUT_NAME "tragar"
  SUFFIX ".js"
)
