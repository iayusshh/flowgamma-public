from typing import Literal

from pydantic import BaseModel, Field


class WatchlistCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64)


class WatchlistAddSymbol(BaseModel):
    symbol: str = Field(min_length=1, max_length=64)


class ActiveSymbolBody(BaseModel):
    symbol: str = Field(min_length=1, max_length=64)


class AdminLoginBody(BaseModel):
    username: str = Field(min_length=1, max_length=128)
    password: str = Field(min_length=1, max_length=256)


class AdminToggleBody(BaseModel):
    enabled: bool


class AdminCooldownBody(BaseModel):
    seconds: int = Field(ge=0, le=3600)


class AdminRefreshNowBody(BaseModel):
    scope: Literal["tracked", "indices", "symbol"] = "tracked"
    symbol: str | None = None
    allow_closed_market: bool = False
