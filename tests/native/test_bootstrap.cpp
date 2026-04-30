/**
 * Slice 1 — Native C++ bootstrap lifecycle tests
 *
 * Tests TRAGarCore construction, storeMode, namespace, and close semantics.
 * Written before the implementation (TDD).
 *
 * Compile with:
 *   g++ -std=c++23 -I../../src/core test_bootstrap.cpp ../../src/core/tragar_core.cpp \
 *       -o test_bootstrap && ./test_bootstrap
 * Or via: just test
 */
#define DOCTEST_CONFIG_IMPLEMENT_WITH_MAIN
#include "doctest.h"

#include "tragar_core.hpp"

using namespace tragar;

TEST_CASE("TRAGarCore — memory store lifecycle")
{
    SUBCASE("create with memory store")
    {
        TRAGarCore core(Config{ .store_mode = StoreMode::Memory });
        CHECK(core.store_mode() == StoreMode::Memory);
        CHECK(core.namespace_name() == "default");
        CHECK_FALSE(core.is_closed());
    }

    SUBCASE("create with custom namespace")
    {
        TRAGarCore core(Config{ .store_mode = StoreMode::Memory, .namespace_str = "my-corpus" });
        CHECK(core.namespace_name() == "my-corpus");
    }

    SUBCASE("close() succeeds the first time")
    {
        TRAGarCore core(Config{ .store_mode = StoreMode::Memory });
        auto result = core.close();
        CHECK(result.has_value());
        CHECK(core.is_closed());
    }

    SUBCASE("close() twice returns AlreadyClosed error")
    {
        TRAGarCore core(Config{ .store_mode = StoreMode::Memory });
        core.close();
        auto result = core.close();
        CHECK_FALSE(result.has_value());
        CHECK(result.error() == ErrorCode::AlreadyClosed);
    }
}
