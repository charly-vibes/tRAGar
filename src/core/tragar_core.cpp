#include "tragar_core.hpp"

namespace tragar {

TRAGarCore::TRAGarCore(Config cfg)
    : cfg_(std::move(cfg))
{}

StoreMode TRAGarCore::store_mode() const noexcept
{
    return cfg_.store_mode;
}

std::string_view TRAGarCore::namespace_name() const noexcept
{
    return cfg_.namespace_str;
}

bool TRAGarCore::is_closed() const noexcept
{
    return closed_;
}

std::expected<void, ErrorCode> TRAGarCore::close() noexcept
{
    if (closed_) {
        return std::unexpected(ErrorCode::AlreadyClosed);
    }
    closed_ = true;
    return {};
}

} // namespace tragar
