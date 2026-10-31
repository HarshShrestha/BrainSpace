class ApiResponse<T = unknown>{
    public readonly statusCode : number;
    public readonly message: string;
    public readonly success : boolean;
    public readonly data : T;

    constructor(
        statusCode : number,
        data : T,
        message : string =  "success"
    ){
        this.statusCode = statusCode;
        this.message = message;
        this.data = data
        this.success = statusCode < 400
    }

}