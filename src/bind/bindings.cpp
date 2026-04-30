/**
 * Embind bridge — Slice 1
 *
 * Exports TRAGarCore lifecycle to JavaScript via Emscripten Embind.
 * Slice 1 scope: constructor, storeMode, namespaceName, isClosed, close.
 * Ingest/query bindings are added in Slice 2.
 */
#include <emscripten/bind.h>
#include "tragar_core.hpp"

using namespace tragar;
using namespace emscripten;

namespace {

/**
 * JS-facing close: converts std::expected result to an exception so that
 * Embind surfaces it as a rejected Promise when called from async JS.
 */
void close_js(TRAGarCore& core)
{
    auto result = core.close();
    if (!result) {
        switch (result.error()) {
        case ErrorCode::AlreadyClosed:
            throw std::runtime_error("InstanceClosed");
        case ErrorCode::InvalidConfig:
            throw std::runtime_error("InvalidConfig");
        }
    }
}

std::string store_mode_str(const TRAGarCore& core)
{
    switch (core.store_mode()) {
    case StoreMode::Memory: return "memory";
    }
    return "unknown";
}

std::string namespace_name_str(const TRAGarCore& core)
{
    return std::string(core.namespace_name());
}

} // namespace

EMSCRIPTEN_BINDINGS(tragar) {
    class_<TRAGarCore>("TRAGarCore")
        .constructor<Config>()
        .function("storeMode",     &store_mode_str)
        .function("namespaceName", &namespace_name_str)
        .function("isClosed",      &TRAGarCore::is_closed)
        .function("close",         &close_js);

    value_object<Config>("Config")
        .field("storeMode",    &Config::store_mode)
        .field("namespaceStr", &Config::namespace_str);

    enum_<StoreMode>("StoreMode")
        .value("Memory", StoreMode::Memory);
}
