using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Xml.Linq;

namespace RedisDemo
{
    public class User
    {
        public string Id { get; set; }
        public string Name { get; set; }
        public string Company { get; set; }

        public static User GetById(string id)
        {
            Console.WriteLine("Getting user {0}...", id);

            return All.First(x => x.Id == id);
        }
        public static IEnumerable<User> All
        {
            get
            {
                Thread.Sleep(5000);

                var data = XDocument.Load(File.OpenRead("Users.xml"));
                return
                    from elm in data.Root.Elements("User")
                    select new User
                    {
                        Id = elm.Element("Id").Value,
                        Name = elm.Element("Name").Value,
                        Company = elm.Element("Company").Value
                    };
            }
        }
    }
}
