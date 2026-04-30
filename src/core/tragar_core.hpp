#pragma once

#include <expected>
#include <string>
#include <string_view>

namespace tragar {

enum class StoreMode {
    Memory,
};

enum class ErrorCode {
    AlreadyClosed,
    InvalidConfig,
};

struct Config {
    StoreMode store_mode  = StoreMode::Memory;
    std::string namespace_str = "default";
};

/**
 * TRAGarCore — the native C++ lifecycle object for one tRAGar instance.
 *
 * Slice 1 scope: construction + close semantics only.
 * Ingest, query, and stats are added in Slice 2.
 */
class TRAGarCore {
public:
    explicit TRAGarCore(Config cfg);
    ~TRAGarCore() = default;

    TRAGarCore(const TRAGarCore&)            = delete;
    TRAGarCore& operator=(const TRAGarCore&) = delete;
    TRAGarCore(TRAGarCore&&)                 noexcept = default;
    TRAGarCore& operator=(TRAGarCore&&)      noexcept = default;

    [[nodiscard]] StoreMode      store_mode()     const noexcept;
    [[nodiscard]] std::string_view namespace_name() const noexcept;
    [[nodiscard]] bool           is_closed()      const noexcept;

    std::expected<void, ErrorCode> close() noexcept;

private:
    Config cfg_;
    bool   closed_ = false;
};

} // namespace tragar
