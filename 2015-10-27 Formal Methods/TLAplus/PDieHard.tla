------------------------------ MODULE PDieHard ------------------------------
EXTENDS Integers

Min(m,n) == IF m < n THEN m ELSE n
(***************************************************************************
--algorithm DieHard {
    variables big = 0, small = 0;
    { while(TRUE)
        {   either  big := 5
            or      small := 3
            or      big := 0
            or      small := 0
            or      with (poured = Min(big+small, 5) - big)
                    {   big := big + poured;
                        small := small - poured }
            or      with (poured = Min(big+small,3) - small)
                    {   big := big - poured;
                        small := small + poured }
        }
        
    }
}
 ***************************************************************************)
\* BEGIN TRANSLATION
VARIABLES big, small

vars == << big, small >>

Init == (* Global variables *)
        /\ big = 0
        /\ small = 0

Next == \/ /\ big' = 5
           /\ small' = small
        \/ /\ small' = 3
           /\ big' = big
        \/ /\ big' = 0
           /\ small' = small
        \/ /\ small' = 0
           /\ big' = big
        \/ /\ LET poured == Min(big+small, 5) - big IN
                /\ big' = big + poured
                /\ small' = small - poured
        \/ /\ LET poured == Min(big+small,3) - small IN
                /\ big' = big - poured
                /\ small' = small + poured

Spec == Init /\ [][Next]_vars

\* END TRANSLATION

=============================================================================
\* Modification History
\* Last modified Tue Oct 27 18:25:55 ICT 2015 by branck
\* Last modified Tue Jun 02 16:21:55 ICT 2015 by branck
\* Created Tue Jun 02 16:05:11 ICT 2015 by branck
