using System;
using System.Collections.Generic;
using System.Linq;

namespace RedisDemo
{
    class Program
    {
        static void Main(string[] args)
        {
            var getUserWithCaching = Cache.Map<string, User>(User.GetById);
            var inputs = GetInputs();

            foreach (var id in inputs)
            {
                var begin = DateTime.Now;
                var user = getUserWithCaching(id);
                var elapsed = DateTime.Now - begin;

                Console.WriteLine("[ Id = {0}, Name = {1}, Company = {2} ]", user.Id, user.Name, user.Company);
                Console.WriteLine("Elapsed Time: {0}", elapsed);
                Console.WriteLine();
            }
        }

        #region 
        public static IEnumerable<string> GetInputs()
        {
            Console.WriteLine("Please enter a user id or 'q' to exit.");

            return InfiniteSeq(Console.ReadLine)
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .TakeWhile(x => x != "q");
        }
        public static IEnumerable<T> InfiniteSeq<T>(Func<T> member)
        {
            while (true)
            {
                yield return member();
            }
        } 
        #endregion
    }
}
