namespace DemoFS

module DiscriminatedUnions =
    type Cat<'t> = SiameseCat of 't | AmericanShortHair of 't
    type Dog<'t> = SiberianHusky of 't | JackRussel of 't
    type Animal<'t> = Bird of 't | Cat of Cat<'t> | Dog of Dog<'t>

    let demoAnimal() =
        let x = Cat(SiameseCat(""))
        
        match x with
        | Cat x ->
            match x with
            | SiameseCat x -> printfn "%A" x
            | AmericanShortHair x -> printfn "%A" x
        | Dog x ->
            match x with
            | SiberianHusky x -> printfn "%A" x
            | JackRussel x -> printfn "%A" x
        | Bird x -> printfn "%A" x
        
        match x with
        | Cat (SiameseCat x) -> printfn "%A" x
        | Cat (AmericanShortHair x) -> printfn "%A" x
        | Dog (SiberianHusky x) -> printfn "%A" x
        | Dog (JackRussel x) -> printfn "%A" x
        | Bird x -> printfn "%A" x

    type Tree<'t> = Tree of (Tree<'t> * Tree<'t>) | Node of 't

    let demoTree() =
        let rec traverseTree t =
            match t with
            | Node t -> printfn "%A" t
            | Tree (l, r) ->
                traverseTree l
                traverseTree r

        let node0 = Node(0)
        let node1 = Node(1)
        let node2 = Node(2)
        let node3 = Tree(node1, node2)
        let t = Tree(node3, node0)

        traverseTree t

