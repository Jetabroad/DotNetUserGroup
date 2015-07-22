namespace DemoFS

open System

type Person = {
    Name: string
    Email: string
    Gender: Gender
}
with 
    interface IUser with
        member this.Identity = this.Email
        member this.Email = this.Email

and Gender = Male | Female | Other of string

[<RequireQualifiedAccess>]
[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module Person =
    let private monitor = Object()
    let mutable private people = []
    let tryGet email = 
        let p =
            query {
                for p in people do
                where (p.Email = email)
                select p
            }
            |> Seq.cache

        if p |> (not << Seq.isEmpty) then 
            Some (p |> Seq.head) 
        else 
            None
    let register p = lock monitor (fun () -> 
        people <- [p] |> List.append people)
    let getAll() = people :> seq<_>
        

