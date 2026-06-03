class LLMServiceError(Exception):
    """可向前端展示的 LLM 调用错误。"""

    def __init__(self, message: str, *, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(message)
