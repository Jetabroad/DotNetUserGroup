// Learn more about F# at http://fsharp.net
// See the 'F# Tutorial' project for more help.

open System
open DemoFS

[<EntryPoint>]
let main argv = 
    let adison = "adison.prakongpan@gmail.com"
    let ace = "arkace@hotmail.com"
    let alien = "alien@b.kelper22"

    //register
    let ap = { Name = "Adison Prakongpan"; Email = ""; Gender = Male }

    registerMany [|
        { ap with Email = "adison.prakongpan@gmail.com" }
        { ap with Email = "adison.prakongpan@bkk.jetabroad.com" }
        { Name = "Ace Adison"; Email = "arkace@hotmail.com"; Gender = Male }
        { Name = "Alien"; Email = "alien@b.kelper22"; Gender = Other("unknown") }
    |]

    //list people
    getAllRegistrants() |> Seq.iter (printfn "%A")

    let getCurrentEmail() = getCurrentLogin().Email

    //send mails
    let sendMailTo = 
        let f s r m = Mail.send (s()) r m 
        f getCurrentEmail

    adison |> login
    sendMailTo ace "Hello! How are you?"

    ace |> login
    sendMailTo adison "I'm fine."

    alien |> login
    [ adison; ace ] |> Seq.iter (fun x -> sendMailTo x "Hello World!!!")

    //list personal inboxes
    let printInboxHeader = printfn "%s's inbox..............................."
    let myInbox() = Mail.inbox (getCurrentEmail())

    ace |> login
    ace |> printInboxHeader
    myInbox() |> Seq.iter (printfn "%A")

    adison |> login
    adison |> printInboxHeader
    myInbox() |> Seq.iter (printfn "%A")

    Console.ReadLine() |> ignore
    0 // return an integer exit code
