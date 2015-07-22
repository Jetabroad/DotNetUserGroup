namespace DemoFS

open System

type Authenticator = string -> IUser option
type Constraint = (IUser -> bool)
type Registration = IUser -> unit
type Register = (unit -> IUser seq)
type Registry = Constraint * Register * Registration

[<AutoOpen>]
module Security =
    let private authenticators: Authenticator list = [
        Person.tryGet >> Option.map (box >> unbox)
    ]
    let private registries: Registry list = [
        (fun a -> a :? Person), 
        Person.getAll >> box >> unbox, 
        Person.register << unbox << box
    ]
    let mutable currentLogin: IUser = null
    let tryAuthenticate identity =
        let p = 
            authenticators 
            |> Seq.map (fun a -> a identity) 
            |> Seq.where Option.isSome
            |> Seq.take 1
            |> Seq.toList
        if p |> (not << List.isEmpty) then p |> List.head else None
    let register registrant =
        registries
        |> Seq.where (fun (isApplicable, _, _) -> isApplicable registrant)
        |> Seq.iter (fun (_, _, register) -> register registrant)
    let registerManyAsync registrants =
        registrants
        |> Seq.map (fun r -> async { do register r })
        |> Async.Parallel
        |> Async.Ignore
    let registerMany registrants =
        registrants
        |> registerManyAsync
        |> Async.RunSynchronously
    let getAllRegistrants() =
        query {
            for _, register, _ in registries do
            for r in register() do
            select r
        }
    let login identity =
        match tryAuthenticate identity with
        | Some a -> currentLogin <- a
        | None -> failwith "Authentication failed."
    let logout() = currentLogin <- null
    let getCurrentLogin() = currentLogin
