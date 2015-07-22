namespace DemoFS

open System

type Sender = string
type Receiver = string
type Message = string
type Mail = Sender * Receiver * Message

[<RequireQualifiedAccess>]
[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module Mail =
    let mutable private mails: Mail list = []
    let inbox: Receiver -> Mail seq = fun p ->
        query {
            for x in mails do
            let s, r, m = x
            where (r = p)
            select x
        }
    let outbox: Sender -> Mail seq = fun p ->
        query {
            for x in mails do
            let s, r, m = x
            where (s = p)
            select x
        }
    let send: Sender -> Receiver -> Message -> unit = fun s r m ->
        mails <- [ (s, r, m) ] |> List.append mails
        

