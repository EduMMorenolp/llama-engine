export class HttpException extends Error {
	constructor(
		public statusCode: number,
		message: string,
	) {
		super(message);
		this.name = "HttpException";
	}
}

export class BadRequestException extends HttpException {
	constructor(message: string) {
		super(400, message);
		this.name = "BadRequestException";
	}
}

export class UnauthorizedException extends HttpException {
	constructor(message: string) {
		super(401, message);
		this.name = "UnauthorizedException";
	}
}

export class ForbiddenException extends HttpException {
	constructor(message: string) {
		super(403, message);
		this.name = "ForbiddenException";
	}
}

export class NotFoundException extends HttpException {
	constructor(message: string) {
		super(404, message);
		this.name = "NotFoundException";
	}
}

export class ConflictException extends HttpException {
	constructor(message: string) {
		super(409, message);
		this.name = "ConflictException";
	}
}
