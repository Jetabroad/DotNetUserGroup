namespace DemoFS

open System

[<AllowNullLiteral>]
type IUser =
    abstract member Identity: string
    abstract member Email: string

