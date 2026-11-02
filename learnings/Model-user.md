    # Understanding and building your Mongoose User Model from scratch

Let's build this file step by step, rather than just understanding the finished code.

Since you're learning TypeScript, Express, MongoDB and Mongoose together, I want you to understand three things at every step:

1. What are we writing?
2. Why are we writing it?
3. How does TypeScript understand it?

Our goal is to build a User model that supports:

- User registration.
- Password hashing.
- Password verification during login.
- Access token generation.
- Refresh token generation.

# Part 1. Understand what we are building

First, let's understand the overall architecture.

## User authentication architecture

User Model

Mongoose + MongoDB

Password handling

bcrypt

Hash password before saving and verify during login.

Token handling

jsonwebtoken

Generate access and refresh tokens.

User document

username, hashed password, timestamps and methods

Before coding, understand one distinction:

- Schema: Defines the structure and behaviour of documents.
- Model: Provides an interface to interact with the MongoDB collection.
- Document: An individual record in MongoDB.

For example, a user document might look like:

```
{
    "_id": "672abc123",
    "username": "harsh",
    "password": "$2b$10$hashedPassword...",
    "createdAt": "2026-10-31T10:00:00Z",
    "updatedAt": "2026-10-31T10:00:00Z"
}
```

# Part 2. Import the required packages

Start your `user.model.ts` file.

```
import mongoose, { Schema, type Model } from "mongoose";
import bcrypt from "bcrypt";
import jwt, { type SignOptions } from "jsonwebtoken";
```

Let's understand every import.

### 1. Mongoose

```
import mongoose, { Schema, type Model } from "mongoose";
```

We import three things:

| Import     | Purpose                                  |
| ---------- | ---------------------------------------- |
| `mongoose` | Interact with MongoDB and create models  |
| `Schema`   | Define document structure and middleware |
| `Model`    | TypeScript type for a Mongoose model     |

Why `type Model`?

Because `Model` is only needed for TypeScript type checking. It doesn't need to exist in the generated JavaScript.

### 2. Bcrypt

```
import bcrypt from "bcrypt";
```

Bcrypt provides two important methods:

```
bcrypt.hash(password, 10);
bcrypt.compare(password, hashedPassword);
```

- `hash()` converts a password into a secure hash.
- `compare()` checks whether a password matches an existing hash.

The number `10` is the cost factor (salt rounds).

### 3. JSON Web Token

```
import jwt, { type SignOptions } from "jsonwebtoken";
```

We need:

- `jwt.sign()` to generate tokens.
- `SignOptions` to understand the TypeScript types accepted by JWT signing options.

# Part 3. Define the User interface

Now let's write:

```
interface IUser {
    username: string;
    password: string;
}
```

This is where TypeScript comes into the picture.

An interface defines the structure of an object.

For example:

```
const user: IUser = {
    username: "harsh",
    password: "123456"
};
```

This is valid.

But:

```
const user: IUser = {
    username: "harsh"
};
```

This produces an error because `password` is required.

Important: `IUser` describes the data stored in the document. It doesn't define the custom methods that we'll add later.

# Part 4. Define custom User methods

Now consider something.

We want every User document to have these methods:

```
user.isPasswordCorrect("123456");

user.generateAccessToken();

user.generateRefreshToken();
```

But TypeScript doesn't automatically know these methods exist.

We need another interface.

```
interface IUserMethods {
    isPasswordCorrect(password: string): Promise<boolean>;

    generateAccessToken(): string;

    generateRefreshToken(): string;
}
```

Let's understand each method.

| Method                 | Input          | Return             |
| ---------------------- | -------------- | ------------------ |
| `isPasswordCorrect`    | Plain password | Promise of boolean |
| `generateAccessToken`  | Nothing        | JWT string         |
| `generateRefreshToken` | Nothing        | JWT string         |

### Why `Promise<boolean>`?

Because our password comparison uses bcrypt asynchronously.

```
async function checkPassword(): Promise<boolean> {
    return bcrypt.compare("123456", "hashedPassword");
}
```

An asynchronous function returns a Promise.

Therefore, we specify:

```
Promise<boolean>
```

### Why do we need two interfaces?

Because they represent different things:

- `IUser` → What data does the user have?
- `IUserMethods` → What operations can the user perform?

This separation makes your code easier to maintain.

# Part 5. Understand the UserModel type

Now comes a slightly advanced TypeScript concept.

```
type UserModel = Model<IUser, {}, IUserMethods>;
```

Don't worry. Let's break it down.

Mongoose's `Model` type accepts multiple generic parameters.

The relevant structure is:

```
Model<RawDocType, TQueryHelpers, TInstanceMethods>
```

In our case:

```
Model<IUser, {}, IUserMethods>
```

| Parameter          | Our value      | Meaning                 |
| ------------------ | -------------- | ----------------------- |
| `RawDocType`       | `IUser`        | User document's data    |
| `TQueryHelpers`    | `{}`           | No custom query helpers |
| `TInstanceMethods` | `IUserMethods` | Custom document methods |

Why do we need this?

Because when we create our schema, we want TypeScript to understand that the resulting User documents have our custom methods.

For example:

```
const user = await User.findOne({ username: "harsh" });

await user?.isPasswordCorrect("123456");
```

TypeScript now recognizes `isPasswordCorrect()`.

Important concept

`IUser` describes document data.

`IUserMethods` describes document methods.

`UserModel` connects both to Mongoose's model typing.

# Part 6. Validate environment variables

Before generating JWT tokens, we need secret keys and expiration durations.

These values are stored in our `.env` file.

For example:

```
ACCESS_TOKEN_SECRET=some_long_random_secret
ACCESS_TOKEN_EXPIRY=15m

REFRESH_TOKEN_SECRET=another_long_random_secret
REFRESH_TOKEN_EXPIRY=7d
```

We access environment variables using:

```
process.env.ACCESS_TOKEN_SECRET
```

But there's a problem.

TypeScript considers `process.env` values to be:

```
string | undefined
```

Why?

Because an environment variable might not exist.

For example:

```
console.log(process.env.ACCESS_TOKEN_SECRET);
```

It could return `undefined`.

We don't want our application generating JWTs without a secret.

### 6.1 Create the getEnv function

```
const getEnv = (key: string): string => {
    const value = process.env[key];

    if (!value) {
        throw new Error(`Missing environment variable: ${key}`);
    }

    return value;
};
```

Let's understand it line by line.

Step 1: Function declaration

```
const getEnv = (key: string): string => {
```

- `key: string` means the function accepts a string.
- `: string` means the function returns a string.

Step 2: Read environment variable

```
const value = process.env[key];
```

Here, we're using dynamic property access.

For example:

```
getEnv("ACCESS_TOKEN_SECRET");
```

is equivalent to:

```
process.env.ACCESS_TOKEN_SECRET;
```

Step 3: Validate

```
if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
}
```

If the variable doesn't exist or is empty, we throw an error.

Step 4: Return

```
return value;
```

Now TypeScript knows that the returned value is a string.

### 6.2 Why do we have a separate getExpiry function?

Your original code contains:

```
const getExpiry = (
    key: string
): NonNullable<SignOptions["expiresIn"]> => {
    const value = getEnv(key);

    return value as NonNullable<SignOptions["expiresIn"]>;
};
```

First, understand this:

```
SignOptions["expiresIn"]
```

This accesses the type of the `expiresIn` property inside the `SignOptions` interface.

It is effectively asking:

"What type of value does jsonwebtoken accept for expiresIn?"

It can accept a number or a duration string, and the property is optional.

For example:

```
expiresIn: "15m"
```

or:

```
expiresIn: 900
```

Now:

```
NonNullable<SignOptions["expiresIn"]>
```

removes `null` and `undefined` from that type.

Why do we need this?

Because when you write:

```
expiresIn: getEnv("ACCESS_TOKEN_EXPIRY")
```

TypeScript may not accept the general `string` type as a valid JWT expiry duration.

We use:

```
value as NonNullable<SignOptions["expiresIn"]>
```

This is a type assertion. It tells TypeScript to treat the value as a valid expiry type.

Important: a type assertion does not validate the actual duration. It only changes how TypeScript treats it.

### 6.3 Can we simplify these two functions?

Yes. If you prefer fewer helpers, keep only `getEnv()` and use the type assertion where needed:

```
expiresIn: getEnv("ACCESS_TOKEN_EXPIRY") as NonNullable<SignOptions["expiresIn"]>
```

This is perfectly reasonable for a small project.

I'd use this approach in your current backend.
