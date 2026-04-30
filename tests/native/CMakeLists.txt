include(FetchContent)

FetchContent_Declare(
  doctest
  GIT_REPOSITORY https://github.com/doctest/doctest.git
  GIT_TAG        v2.4.11
)
FetchContent_MakeAvailable(doctest)

add_executable(test_bootstrap test_bootstrap.cpp)
target_link_libraries(test_bootstrap PRIVATE tragar_core doctest::doctest)
target_compile_features(test_bootstrap PRIVATE cxx_std_23)

include(doctest)
doctest_discover_tests(test_bootstrap)
