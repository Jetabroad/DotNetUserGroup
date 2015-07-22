using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNet.Mvc;

// For more information on enabling Web API for empty projects, visit http://go.microsoft.com/fwlink/?LinkID=397860

namespace Favorites.API
{
    [Route("api/[controller]")]
    public class FavoritesController : Controller
    {
        public static IList<string> FavoritesStore;

        // GET: api/values
        [HttpGet]
        public IEnumerable<string> Get() => FavoritesStore;

        // POST api/values
        [HttpPost]
        public void Post([FromBody]string tweet)
        {
            FavoritesStore.Insert(0, tweet);
        }
    }
}
