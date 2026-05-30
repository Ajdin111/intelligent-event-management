from typing import Annotated, Generic, TypeVar, List
from datetime import datetime
from pydantic import BaseModel, AfterValidator


def _strip_tz(v: datetime) -> datetime:
    if v.tzinfo is not None:
        return v.replace(tzinfo=None)
    return v


# AfterValidator runs after Pydantic parses the input (string or datetime) into
# a datetime object, so timezone info is always present/absent on a real datetime.
NaiveDatetime = Annotated[datetime, AfterValidator(_strip_tz)]

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    total: int
    skip: int
    limit: int
    items: List[T]
